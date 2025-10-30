# JSON Parser Usage Guide

## Location
`src/utils/jsonParser.ts` - Pre-installed in your project

## Why Use It?

When building apps that interact with AI/LLM APIs, you often receive JSON responses that are:
- ❌ Malformed (missing quotes, trailing commas)
- ❌ Wrapped in markdown (```json ... ```)
- ❌ Mixed with text ("Here's the data: {...}")
- ❌ Using Python syntax (True instead of true)
- ❌ Partially truncated

This parser handles **all of these cases automatically**.

## Basic Usage

```typescript
import parseLLMJson from '@/utils/jsonParser'

// Example: AI returns this messy response
const aiResponse = `
Here's the user data:
\`\`\`json
{
  'name': 'John',
  'age': 30,
  'active': True,  // Python-style
}
\`\`\`
`

// Parse it easily
const parsed = parseLLMJson(aiResponse)

if (parsed) {
  console.log(parsed.name)    // 'John'
  console.log(parsed.age)     // 30
  console.log(parsed.active)  // true (converted)
}
```

## Options

```typescript
const parsed = parseLLMJson(response, {
  attemptFix: true,      // Auto-fix common issues (default: true)
  preferFirst: true,     // Use first valid JSON found (default: true)
  allowPartial: false,   // Allow incomplete JSON (default: false)
  maxBlocks: 5          // Max JSON blocks to try (default: 5)
})
```

### `attemptFix` (default: true)
Automatically fixes:
- Single quotes → double quotes
- Trailing commas
- Python True/False/None → JavaScript true/false/null
- Missing closing quotes (if allowPartial is true)
- Comments (// and /* */)

### `preferFirst` (default: true)
When multiple JSON objects are found:
- `true`: Returns the first valid one
- `false`: Returns the last valid one

### `allowPartial` (default: false)
Handle truncated JSON:
- `true`: Attempts to close unclosed strings and objects
- `false`: Rejects incomplete JSON

### `maxBlocks` (default: 5)
Maximum number of potential JSON blocks to attempt parsing.

## Common Use Cases

### 1. Parse AI Chat Response

```typescript
const [messages, setMessages] = useState<any[]>([])

const sendMessage = async (userMessage: string) => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: userMessage })
  })

  const aiResponse = await response.text()

  // Parse the AI's JSON response
  const parsed = parseLLMJson(aiResponse, { attemptFix: true })

  if (parsed) {
    setMessages([...messages, parsed])
  }
}
```

### 2. Extract Data from Markdown

```typescript
const markdownWithJson = `
# API Response

Here's the product data:

\`\`\`json
{
  "id": 123,
  "name": "Widget",
  "price": 29.99
}
\`\`\`

Use this for your app.
`

const product = parseLLMJson(markdownWithJson)
console.log(product.price) // 29.99
```

### 3. Handle Multiple JSON Objects

```typescript
const multipleJson = `
First object: {"id": 1, "name": "Alice"}
Second object: {"id": 2, "name": "Bob"}
`

// Get first object
const first = parseLLMJson(multipleJson, { preferFirst: true })
console.log(first.name) // 'Alice'

// Get last object
const last = parseLLMJson(multipleJson, { preferFirst: false })
console.log(last.name) // 'Bob'
```

### 4. Parse Streaming Response

```typescript
const [partialResponse, setPartialResponse] = useState('')

useEffect(() => {
  const eventSource = new EventSource('/api/stream')

  eventSource.onmessage = (event) => {
    const chunk = event.data
    setPartialResponse(prev => prev + chunk)

    // Try to parse what we have so far
    const parsed = parseLLMJson(partialResponse, {
      allowPartial: true  // Allow incomplete JSON
    })

    if (parsed) {
      // We got enough to parse!
      updateUI(parsed)
    }
  }
}, [partialResponse])
```

## Return Value

The parser returns:
- **Parsed object** if successful
- **null** if parsing failed (safe to check)

```typescript
const result = parseLLMJson(response)

if (result) {
  // Success - use the data
  console.log(result.data)
} else {
  // Failed - handle error
  console.error('Could not parse JSON')
}
```

## Advanced Features

### Caching
The parser caches results for identical inputs:
```typescript
// First call: parses and caches
const data1 = parseLLMJson(response)

// Second call: returns cached result (instant)
const data2 = parseLLMJson(response)
```

### Error Handling
The parser never throws errors:
```typescript
// These all safely return null
parseLLMJson(null)              // null
parseLLMJson(undefined)         // null
parseLLMJson("not json at all") // null
parseLLMJson("{broken json")    // null (unless attemptFix fixes it)
```

## Real-World Example

Complete AI chat app with JSON parser:

```typescript
import { useState } from 'react'
import parseLLMJson from '@/utils/jsonParser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim()) return

    // Add user message
    const userMessage: Message = { role: 'user', content: input }
    setMessages([...messages, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Call AI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })

      const rawResponse = await response.text()

      // Parse AI response using the parser
      const parsed = parseLLMJson(rawResponse, {
        attemptFix: true,
        preferFirst: true
      })

      if (parsed && parsed.message) {
        // Add assistant message
        const assistantMessage: Message = {
          role: 'assistant',
          content: parsed.message
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        // Fallback if not JSON
        const assistantMessage: Message = {
          role: 'assistant',
          content: rawResponse
        }
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="space-y-4 mb-4">
        {messages.map((msg, i) => (
          <Card key={i} className={msg.role === 'user' ? 'ml-auto max-w-md' : 'mr-auto max-w-md'}>
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-1">{msg.role}</p>
              <p>{msg.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          disabled={loading}
        />
        <Button onClick={sendMessage} disabled={loading}>
          {loading ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  )
}

export default ChatApp
```

## Summary

✅ **Always use** `parseLLMJson` when handling AI/LLM JSON responses
✅ **Handles edge cases** automatically (malformed, markdown, Python syntax)
✅ **Safe to use** - returns null on failure, never throws
✅ **Fast** - caches results for repeated inputs
✅ **Flexible** - options for different parsing strategies

❌ **Never write custom JSON parsers** - this utility handles everything!

## Questions?

Check the source: `src/utils/jsonParser.ts` (338 lines of robust parsing logic)
