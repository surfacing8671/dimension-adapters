







import { Chain } from "@defillama/sdk/build/general";
import BigNumber from "bignumber.js";
import request, { gql } from "graphql-request";
import { Adapter, BreakdownAdapter, FetchResult, FetchResultFees, SimpleAdapter } from "../adapters/types";
import { CHAIN } from "../helpers/chains";
import { DEFAULT_DAILY_VOLUME_FACTORY, DEFAULT_TOTAL_VOLUME_FIELD, getUniqStartOfTodayTimestamp } from "../helpers/getUniSubgraphVolume";
import { getTimestampAtStartOfDayUTC, getTimestampAtStartOfPreviousDayUTC } from "../utils/date";
import { getGraphDimensions } from "../helpers/getUniSubgraph";
import { getBlock } from "../helpers/getBlock";

interface IPoolData {
  id: number;
  feesUSD: string;
}



type IURL = {
  [l: string | Chain]: string;
}

const endpoints: IURL = {
  [CHAIN.EON]: "https://eon-graph.horizenlabs.io/subgraphs/name/Ascent/ascent-subgraph"
}




const STABLE_FEES = 0.0001;
const VOLATILE_FEES = 0.002;
const endpoint =
  "https://eon-graph.horizenlabs.io/subgraphs/name/Ascent/ascent-subgraph";

const getFees = () => {
  return async (timestamp: number): Promise<FetchResultFees> => {
    const todaysTimestamp = getTimestampAtStartOfDayUTC(timestamp);
    const yesterdaysTimestamp = getTimestampAtStartOfPreviousDayUTC(timestamp);
    const todaysBlock = await getBlock(
      todaysTimestamp,
      "eon",
      {}
    );
    const yesterdaysBlock = await getBlock(yesterdaysTimestamp, "eon", {});

    const query = gql`
      query fees {
        yesterday: pairs(block: {number: ${yesterdaysBlock}}, where: {volumeUSD_gt: "0"}, first: 1000) {
          id
          isStable
          volumeUSD
        }
        today: pairs(block: {number: ${todaysBlock}}, where: {volumeUSD_gt: "0"}, first: 1000) {
          id
          isStable
          volumeUSD
        }
      }
    `;
    const todayVolume: { [id: string]: BigNumber } = {};
    const graphRes = await request(endpoint, query);
    let dailyFee = new BigNumber(0);
    for (const pool of graphRes["today"]) {
      todayVolume[pool.id] = new BigNumber(pool.volumeUSD);
    }

    for (const pool of graphRes["yesterday"]) {
      if (!todayVolume[pool.id]) continue;
      const dailyVolume = BigNumber(todayVolume[pool.id]).minus(
        pool.volumeUSD
      );
      if (pool.isStable) {
        dailyFee = dailyFee.plus(dailyVolume.times(STABLE_FEES));
      } else {
        dailyFee = dailyFee.plus(dailyVolume.times(VOLATILE_FEES));
      }
    }

    return {
      timestamp,
      dailyFees: dailyFee.toString(),
     
      dailyRevenue: dailyFee.multipliedBy(0.32).toString(),
    };
  };
};


const methodology = {
  UserFees: "User pays 0.2% fees on each swap.",
  ProtocolRevenue: "Revenue going to the protocol.",
  HoldersRevenue: "User fees are distributed among holders."
  }

  const adapter: SimpleAdapter = {
      adapter: {
          [CHAIN.EON]: {
              fetch: getFees(),
              start: async () => 1662425243,
            
          meta: {
            methodology: {
              ...methodology,
              UserFees: "User pays 0.05%, 0.30%, or 1% on each swap."
            }
          }
      }
      }
  }




              export default adapter;