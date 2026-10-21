import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useData<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    let current = true;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    api<T>(path, { signal: abort.signal })
      .then((result) => {
        if (current) setData(result);
      })
      .catch((err: Error) => {
        if (current) setError(err.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      abort.abort();
    };
  }, [path, version]);
  return { data, error, loading, refresh };
}
