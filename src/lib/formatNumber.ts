// Utility to format numbers with thousands separator commas
export const formatWithCommas = (val: string | number): string => {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  
  // Non-numeric strings or special identifiers should be returned as-is
  if (
    str === "" ||
    str === "Error" ||
    str === "NaN" ||
    str === "Infinity" ||
    str === "-Infinity" ||
    str === "Unable to solve" ||
    str === "🔒" ||
    str === "Trial used" ||
    str.includes("=") ||
    str.includes("x =") ||
    str.includes("Trial") ||
    str.includes("Premium")
  ) {
    return str;
  }

  // Handle numbers with optional sign and decimals
  const num = Number(str);
  if (isNaN(num) || !isFinite(num)) {
    return str;
  }

  const parts = str.split(".");
  const intVal = parseInt(parts[0], 10);
  if (isNaN(intVal)) return str;

  const formattedInt = intVal.toLocaleString("en-US");
  if (parts.length > 1) {
    return `${formattedInt}.${parts[1]}`;
  }
  return formattedInt;
};
