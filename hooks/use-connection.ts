"use client";
import { useState, useEffect } from "react";

const CONN_KEY = "pg_connection_id";

function readLS() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CONN_KEY) ?? "";
}

export function useConnection() {
  const [connectionId, setConnectionIdState] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setConnectionIdState(readLS());
    setLoaded(true);
  }, []);

  function setConnectionId(id: string) {
    setConnectionIdState(id);
    if (id) localStorage.setItem(CONN_KEY, id);
    else localStorage.removeItem(CONN_KEY);
  }

  function clearConnection() {
    setConnectionIdState("");
    localStorage.removeItem(CONN_KEY);
  }

  return { connectionId, setConnectionId, clearConnection, loaded };
}
