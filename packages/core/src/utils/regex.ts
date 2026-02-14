export function toRegExp(message: string): RegExp {
  return new RegExp(`^${message.replaceAll(/{([^}]+)}/g, '(?<$1>[^\\s]+)')}$`, 'i');
}
