export default {
  org: 'thgenergy',
  repos: ['fe-redesign', 'be-revamp', 'API-docs'],
  outputDir: './output',
  
  // Patterns to identify test files
  testFilePatterns: [
    '*.test.*',
    '*.spec.*',
    '__tests__/',
    '__mocks__/',
    'e2e/',
    'tests/',
    'test/',
    '*.stories.*',
    'integration/',
    'fixtures/',
    '.test/',
    '.spec/'
  ],
  
  // Concurrency for processing PRs
  prConcurrency: 5,
  
  // Retry configuration
  maxRetries: 3,
  retryDelayMs: 1000,
  
  // Rate limit warning threshold
  rateLimitWarningThreshold: 100
}
