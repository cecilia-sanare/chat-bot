import { config, defined } from '../../config';
import { Radarr } from '../../services/radarr';
import { Sonarr } from '../../services/sonarr';

export const sonarr = defined.sonarr(config.sonarr) ? new Sonarr(config.sonarr) : undefined;
export const radarr = defined.radarr(config.radarr) ? new Radarr(config.radarr) : undefined;
