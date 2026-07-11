"use client";
import { useState, useEffect } from "react";

export function useConnection() {
  const [connectionId, setConnectionIdState] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/connections")
      .then(r => r.ok ? r.json() : [])
      .then((connections: { id: string }[]) => {
        if (connections.length > 0) {
          setConnectionIdState(connections[connections.length - 1].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function setConnectionId(id: string) {
    setConnectionIdState(id);
  }

  function clearConnection() {
    setConnectionIdState("");
  }

  return { connectionId, setConnectionId, clearConnection, loaded };
}
