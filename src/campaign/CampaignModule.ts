import type { GameModule } from '../core/contracts/GameModule';
import { CampaignSession } from './CampaignSession';
import { CAMPAIGN_CONFIG } from './config/campaign.config';
import { campaignThumbnail } from './ui/art';

/**
 * Tercera entrada del hub: el modo campaña. Para el shell es un módulo más; por dentro
 * orquesta los minijuegos existentes sin duplicarlos.
 */
export const togasCampaign: GameModule = {
  id: CAMPAIGN_CONFIG.id,
  title: CAMPAIGN_CONFIG.title,
  version: CAMPAIGN_CONFIG.version,
  description: CAMPAIGN_CONFIG.description,
  badge: 'Campaña',
  get thumbnail() {
    return campaignThumbnail();
  },
  supportedInputs: ['touch', 'mouse', 'keyboard'],
  // Todo el arte y el sonido se generan por código: no hay nada que descargar.
  preload: () => Promise.resolve(),
  create: (context) => new CampaignSession(context),
  destroy: () => undefined,
};
