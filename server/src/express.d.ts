// Augment express-serve-static-core to allow merged params from parent routers
import {} from 'express';

declare module 'express-serve-static-core' {
  interface ParamsDictionary {
    id?: string;
    code?: string;
  }
}
