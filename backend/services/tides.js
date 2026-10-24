// TODO (backend): NOAA CO-OPS datagetter. Station 8771450 (Galveston Pier 21).
// Products: predictions (hourly + hilo), water_temperature, salinity (optional -> "missing").
// Base: https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
export async function getTides({ start, days }) {
  throw new Error('getTides not implemented')
}
