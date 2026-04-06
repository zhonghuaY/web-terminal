import { Router, type Request, type Response } from 'express';
import type { PreferencesManager } from './preferences-manager.js';

export function createPreferencesRouter(prefsMgr: PreferencesManager): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json(prefsMgr.get());
  });

  router.put('/', (req: Request, res: Response) => {
    const { theme, fontSize, fontFamily } = req.body ?? {};
    const updated = prefsMgr.update({ theme, fontSize, fontFamily });
    res.json(updated);
  });

  return router;
}
