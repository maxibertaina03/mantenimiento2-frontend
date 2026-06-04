/** Forma uniforme de respuesta paginada del backend. */
export interface RespuestaPaginada<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
}

/** Forma del error JSON que devuelve el filtro de excepciones del backend. */
export interface ErrorApi {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}
