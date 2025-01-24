import { useQuery } from "@tanstack/react-query";
import { useConnex } from "@vechain/vechain-kit";

export const currentBlockQueryKey = () => ["CURRENT_BLOCK"];

/**
 *
 * @returns  the current block
 */
export const useCurrentBlock = () => {
  const { thor } = useConnex();
  return useQuery({
    queryKey: currentBlockQueryKey(),
    queryFn: () => thor.status.head,
    enabled: !!thor,
    refetchInterval: 1000 * 10,
  });
};
