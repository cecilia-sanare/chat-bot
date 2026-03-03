export function toRegExpFunction(message: string): RegExpFunction {
  const conformedMessage = message
    .replaceAll(/{\.{3}([^}]+)}/g, '(?<$1>.+)')
    .replaceAll(/{([^}]+)}/g, '(?<$1>[^\\s]+|"[^"]+")');

  const regex = new RegExp(`^${conformedMessage}$`, 'i');
  return (value: string) => {
    const result = regex.exec(value);

    return [
      !!result,
      Object.entries(result?.groups ?? {}).reduce<Record<string, string>>((output, [key, value]) => {
        output[key] = value.startsWith('"') && value.endsWith('"') ? value.substring(1, value.length - 1) : value;
        return output;
      }, {}),
    ] as const;
  };
}

export type RegExpFunction = (value: string) => [boolean, Record<string, string>];
