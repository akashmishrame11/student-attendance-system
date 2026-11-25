import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../services/api";

/**
 * Fetch data from the API with loading / error / refetch handling.
 * const { data, meta, loading, error, refetch } = useApi("/students", { page: 1 });
 * Pass `null` as path to skip the request.
 */
export function useApi(path, params, { deps = [], initial = null } = {}) {
  const [state, setState] = useState({ data: initial, meta: null, loading: Boolean(path), error: null });
  const key = JSON.stringify(params || {});
  const reqId = useRef(0);

  const fetchData = useCallback(async () => {
    if (!path) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await api.get(path, { params: JSON.parse(key) });
      if (id === reqId.current) setState({ data: res.data.data, meta: res.data.meta || null, loading: false, error: null });
    } catch (err) {
      if (id === reqId.current) setState((s) => ({ ...s, loading: false, error: errorMessage(err) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData, setData: (data) => setState((s) => ({ ...s, data })) };
}

export function useDebounce(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Load dropdown options: useOptions("/departments", d => ({ value: d._id, label: d.name })) */
export function useOptions(path, mapFn, params) {
  const { data, loading } = useApi(path, { all: "true", ...(params || {}) });
  const options = (Array.isArray(data) ? data : []).map(mapFn);
  return { options, loading, raw: data || [] };
}
