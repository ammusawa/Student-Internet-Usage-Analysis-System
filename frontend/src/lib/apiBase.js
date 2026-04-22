export function getApiBase() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000";
  }
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}
