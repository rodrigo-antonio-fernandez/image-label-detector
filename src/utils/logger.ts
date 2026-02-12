export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static logLevel: LogLevel =
    process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;

  /**
   * Configura el nivel de log
   */
  static setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Formatea un mensaje con timestamp
   */
  private static formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${level}] ${timestamp} - ${message}`;
  }

  /**
   * Formatea datos adicionales para logging
   */
  private static formatData(data: any): string {
    if (!data) return "";

    try {
      if (typeof data === "object") {
        return "\n" + JSON.stringify(data, null, 2);
      }
      return String(data);
    } catch (error) {
      return "[Error al serializar datos]";
    }
  }

  /**
   * Log de nivel DEBUG
   */
  static debug(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.debug(
        this.formatMessage("DEBUG", message) + this.formatData(data),
      );
    }
  }

  /**
   * Log de nivel INFO
   */
  static info(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(this.formatMessage("INFO", message) + this.formatData(data));
    }
  }

  /**
   * Log de nivel WARN
   */
  static warn(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(this.formatMessage("WARN", message) + this.formatData(data));
    }
  }

  /**
   * Log de nivel ERROR
   */
  static error(message: string, error?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      const errorMessage = this.formatMessage("ERROR", message);

      if (error) {
        if (error instanceof Error) {
          console.error(errorMessage, {
            message: error.message,
            stack: error.stack,
            name: error.name,
          });
        } else {
          console.error(errorMessage, error);
        }
      } else {
        console.error(errorMessage);
      }
    }
  }

  /**
   * Log con nivel personalizado
   */
  static log(level: LogLevel, message: string, data?: any): void {
    switch (level) {
      case LogLevel.DEBUG:
        this.debug(message, data);
        break;
      case LogLevel.INFO:
        this.info(message, data);
        break;
      case LogLevel.WARN:
        this.warn(message, data);
        break;
      case LogLevel.ERROR:
        this.error(message, data);
        break;
    }
  }

  /**
   * Crea un logger con contexto específico
   */
  static createContextLogger(context: string) {
    return {
      debug: (message: string, data?: any) =>
        this.debug(`[${context}] ${message}`, data),
      info: (message: string, data?: any) =>
        this.info(`[${context}] ${message}`, data),
      warn: (message: string, data?: any) =>
        this.warn(`[${context}] ${message}`, data),
      error: (message: string, error?: any) =>
        this.error(`[${context}] ${message}`, error),
    };
  }

  /**
   * Registra el inicio de una operación y retorna una función para registrar su fin
   */
  static startTimer(operationName: string): () => void {
    const startTime = Date.now();
    this.debug(`Iniciando: ${operationName}`);

    return () => {
      const duration = Date.now() - startTime;
      this.debug(`Completado: ${operationName}`, { durationMs: duration });
    };
  }

  /**
   * Wrapper para funciones asíncronas con logging automático
   */
  static async withLogging<T>(
    operationName: string,
    fn: () => Promise<T>,
    logLevel: LogLevel = LogLevel.DEBUG,
  ): Promise<T> {
    const startTime = Date.now();
    this.log(logLevel, `Iniciando: ${operationName}`);

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.log(logLevel, `Completado: ${operationName}`, {
        durationMs: duration,
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`Error en: ${operationName}`, { error, durationMs: duration });
      throw error;
    }
  }
}
