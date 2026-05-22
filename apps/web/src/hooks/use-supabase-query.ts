import useSWR from "swr";

export function useSupabaseQuery<T>(key: string | null, fetcher: () => Promise<T>) {
  return useSWR(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30000, // 30 seconds
  });
}
