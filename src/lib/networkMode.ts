import { useEffect, useState } from "react";

export type NetworkPreference = "online" | "offline";
const KEY = "nume.network-mode.v1";
const EVENT = "nume:network-mode";

export const getNetworkPreference = (): NetworkPreference => {
  try {
    return localStorage.getItem(KEY) === "offline" ? "offline" : "online";
  } catch {
    return "online";
  }
};

export const setNetworkPreference = (pref: NetworkPreference) => {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
};

/** online = user chose Online mode AND the device actually has a connection. */
export function useNetworkMode() {
  const [pref, setPref] = useState<NetworkPreference>(getNetworkPreference);
  const [deviceOnline, setDeviceOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const sync = () => {
      setPref(getNetworkPreference());
      setDeviceOnline(navigator.onLine);
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return {
    preference: pref,
    deviceOnline,
    online: pref === "online" && deviceOnline,
    setPreference: setNetworkPreference,
  };
}
