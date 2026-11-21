/**
 * IPAM (IP Address Management) Utility Library
 * Handles IPv4 CIDR calculation, subnet masks, bitwise validations,
 * host ranges, and network/broadcast address checking.
 */

export interface CidrInfo {
  cidr: string;
  ipVersion: 'IPv4';
  prefix: number;
  netmask: string;
  networkAddress: string;
  broadcastAddress: string;
  totalAddresses: number;
  usableHosts: number;
  firstUsableIp: string;
  lastUsableIp: string;
}

export interface HostValidationResult {
  valid: boolean;
  error?: string;
  cidrInfo?: CidrInfo;
}

export function ipToInt(ip: string): number {
  const octets = ip.trim().split('.');
  if (octets.length !== 4) {
    throw new Error(`Format IPv4 tidak valid: "${ip}"`);
  }
  let result = 0;
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(octets[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255 || octets[i] !== octet.toString()) {
      throw new Error(`Octet ke-${i + 1} tidak valid: "${octets[i]}"`);
    }
    result = ((result << 8) | octet) >>> 0;
  }
  return result >>> 0;
}

export function intToIp(intVal: number): string {
  const uInt = intVal >>> 0;
  const o1 = (uInt >>> 24) & 0xff;
  const o2 = (uInt >>> 16) & 0xff;
  const o3 = (uInt >>> 8) & 0xff;
  const o4 = uInt & 0xff;
  return `${o1}.${o2}.${o3}.${o4}`;
}

export function getNetmaskInt(prefix: number): number {
  if (prefix === 0) return 0;
  if (prefix === 32) return 0xffffffff >>> 0;
  return ((0xffffffff << (32 - prefix)) & 0xffffffff) >>> 0;
}

export function parseCidr(cidr: string): CidrInfo {
  const parts = cidr.trim().split('/');
  if (parts.length !== 2) {
    throw new Error(`Format CIDR tidak valid (contoh: 192.168.1.0/24): "${cidr}"`);
  }

  const [ipPart, prefixPart] = parts;
  const prefix = parseInt(prefixPart, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32 || prefixPart !== prefix.toString()) {
    throw new Error(`Prefix subnet tidak valid (harus 0-32): "${prefixPart}"`);
  }

  const rawIpInt = ipToInt(ipPart);
  const maskInt = getNetmaskInt(prefix);
  const networkInt = (rawIpInt & maskInt) >>> 0;
  const invertedMask = (~maskInt & 0xffffffff) >>> 0;
  const broadcastInt = (networkInt | invertedMask) >>> 0;

  const totalAddresses = Math.pow(2, 32 - prefix);
  let usableHosts: number;
  let firstUsableInt: number;
  let lastUsableInt: number;

  if (prefix === 32) {
    usableHosts = 1;
    firstUsableInt = networkInt;
    lastUsableInt = networkInt;
  } else if (prefix === 31) {
    // RFC 3021 Point-to-Point
    usableHosts = 2;
    firstUsableInt = networkInt;
    lastUsableInt = broadcastInt;
  } else {
    usableHosts = Math.max(0, totalAddresses - 2);
    firstUsableInt = (networkInt + 1) >>> 0;
    lastUsableInt = (broadcastInt - 1) >>> 0;
  }

  return {
    cidr: `${intToIp(networkInt)}/${prefix}`,
    ipVersion: 'IPv4',
    prefix,
    netmask: intToIp(maskInt),
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    totalAddresses,
    usableHosts,
    firstUsableIp: intToIp(firstUsableInt),
    lastUsableIp: intToIp(lastUsableInt),
  };
}

export function validateHostIp(ip: string, subnetCidr: string): HostValidationResult {
  try {
    const info = parseCidr(subnetCidr);
    const hostInt = ipToInt(ip);
    const hostIp = intToIp(hostInt);

    const netInt = ipToInt(info.networkAddress);
    const bcastInt = ipToInt(info.broadcastAddress);

    // Cek apakah host berada dalam rentang subnet
    if (hostInt < netInt || hostInt > bcastInt) {
      return {
        valid: false,
        error: `Alamat IP ${hostIp} berada di luar rentang subnet ${info.cidr} (${info.networkAddress} - ${info.broadcastAddress})`,
        cidrInfo: info,
      };
    }

    // Untuk prefix <= 30, network address dan broadcast address tidak boleh dialokasikan sebagai host
    if (info.prefix <= 30) {
      if (hostInt === netInt) {
        return {
          valid: false,
          error: `Alamat IP ${hostIp} adalah Network Address dari ${info.cidr} dan tidak boleh dialokasikan untuk host`,
          cidrInfo: info,
        };
      }
      if (hostInt === bcastInt) {
        return {
          valid: false,
          error: `Alamat IP ${hostIp} adalah Broadcast Address dari ${info.cidr} dan tidak boleh dialokasikan untuk host`,
          cidrInfo: info,
        };
      }
    }

    return {
      valid: true,
      cidrInfo: info,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Validasi IP gagal',
    };
  }
}

export interface P2pHostResult {
  valid: boolean;
  hostIp?: string;
  peerIp?: string;
  cidrInfo?: CidrInfo;
  error?: string;
}

/**
 * Validasi host IPv4 khusus link Point-to-Point (/30 atau /31 RFC 3021)
 * serta menghitung alamat peer lawannya.
 */
export function parsePointToPointHost(ip: string, prefix: number): P2pHostResult {
  if (prefix !== 30 && prefix !== 31) {
    return {
      valid: false,
      error: 'Hanya prefix Point-to-Point /30 atau /31 yang diperbolehkan.',
    };
  }

  try {
    const hostInt = ipToInt(ip);
    const hostIp = intToIp(hostInt);
    const cidrInfo = parseCidr(`${hostIp}/${prefix}`);
    const check = validateHostIp(hostIp, cidrInfo.cidr);
    if (!check.valid) {
      return {
        valid: false,
        cidrInfo,
        error: check.error,
      };
    }

    const peerIp =
      hostIp === cidrInfo.firstUsableIp ? cidrInfo.lastUsableIp : cidrInfo.firstUsableIp;

    return {
      valid: true,
      hostIp,
      peerIp,
      cidrInfo,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Format IPv4 tidak valid',
    };
  }
}
