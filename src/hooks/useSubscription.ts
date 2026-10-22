import { useState, useEffect } from "react";
import { restorePlayBillingPurchases } from "@/lib/playBilling";

export const useSubscription = () => {
  const [isPro, setIsPro] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const check = async () => {
      const purchased =
        localStorage.getItem("nume.pro.purchased") === "true" ||
        localStorage.getItem("scicalc.pro.purchased") === "true";
      if (purchased) {
        setIsPro(true);
      } else {
        const cloudPurchased = await restorePlayBillingPurchases();
        setIsPro(cloudPurchased);
      }
      setLoading(false);
    };
    void check();
  }, []);

  const setProStatus = (status: boolean) => {
    setIsPro(status);
    localStorage.setItem("nume.pro.purchased", status ? "true" : "false");
    localStorage.setItem("scicalc.pro.purchased", status ? "true" : "false");
  };

  return { isPro, setIsPro: setProStatus, loading };
};
