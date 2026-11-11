// jest-expo stubs native modules, so expo-crypto's randomUUID returns undefined under Jest.
// Provide a real implementation here; the app keeps using expo-crypto on device.
const mockNodeCrypto = require('node:crypto');

jest.mock('expo-crypto', () => ({
  randomUUID: () => mockNodeCrypto.randomUUID(),
}));
