import { Flarie } from '@flarie/core';
import { addLookupCommand } from './lookup';
import { addQueueCommand } from './queue';
import { defined, config } from '../../config';
import { Radarr } from '../../services/radarr';
import { Sonarr } from '../../services/sonarr';

export function addArrCommands(flarie: Flarie) {
  if (!defined.sonarr(config.sonarr) || !defined.radarr(config.radarr)) return;

  const sonarr = new Sonarr(config.sonarr);
  const radarr = new Radarr(config.radarr);

  addLookupCommand(flarie, sonarr, radarr);
  addQueueCommand(flarie, sonarr, radarr);
}
