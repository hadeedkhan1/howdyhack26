// TODO (backend): Open-Meteo forecast (temp, wind speed/dir, pressure, apparent temp)
// and Open-Meteo marine (wave height). Use timezone=America/Chicago (DST ends Nov 1!).
export async function getWeather({ lat, lon, start, days }) {
  throw new Error('getWeather not implemented')
}
