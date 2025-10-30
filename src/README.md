# /src Directory

This directory contains shared application code following Next.js 13+ best practices.

## Structure

```
src/
├── components/      # Reusable UI components
│   └── ui/         # shadcn/ui components (51 pre-installed)
├── lib/            # Utility functions and configurations
│   └── utils.ts    # cn() for className merging
├── utils/          # Application utilities
│   ├── jsonParser.ts    # LLM JSON parsing with error handling
│   └── aiAgent.ts       # AI Agent API client
├── hooks/          # Custom React hooks
├── types/          # TypeScript type definitions
└── assets/         # Static assets (images, fonts, etc.)
```

## Import Paths

Use the `@/` alias to import from this directory:

```typescript
import { cn } from '@/lib/utils'
import parseLLMJson from '@/utils/jsonParser'
import { Button } from '@/components/ui/button'
```

## Guidelines

- **components/ui**: Don't modify directly - managed by shadcn/ui
- **utils**: Add app-specific utility functions here
- **lib**: Add third-party library configurations
- **hooks**: Custom React hooks for shared logic
- **types**: Shared TypeScript types and interfaces
