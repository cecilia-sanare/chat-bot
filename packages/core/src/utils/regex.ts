export function toRegExpFunction(message: string | string[]): RegExpFunction {
  const messages = Array.isArray(message) ? message : [message];

  const conformedMessages = messages.map((message) =>
    message.replaceAll(/{\.{3}([^}]+)}/g, '(?<$1>.+)').replaceAll(/{([^}]+)}/g, '(?<$1>[^\\s]+|"[^"]+")')
  );

  const regexes = conformedMessages.map((message) => new RegExp(`^${message}$`, 'i'));
  return (value: string) => {
    const result = exec(regexes, value);

    return [
      !!result,
      Object.entries(result?.groups ?? {}).reduce<Record<string, string>>((output, [key, value]) => {
        output[key] = value.startsWith('"') && value.endsWith('"') ? value.substring(1, value.length - 1) : value;
        return output;
      }, {}),
    ] as const;
  };
}

export function exec(regexes: RegExp[], value: string) {
  for (const regex of regexes) {
    const result = regex.exec(value);

    if (result === null) continue;

    return result;
  }

  return null;
}

export type RegExpFunction = (value: string) => [boolean, Record<string, string>];
