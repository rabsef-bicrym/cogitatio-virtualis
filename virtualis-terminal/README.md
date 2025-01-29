# COGITATIO VIRTUALIS - Cogitation Terminal

A neural terminal interface merging traditional command-line aesthetics with modern AI capabilities. The Cogitation Terminal provides a retro-futuristic interface for AI-powered document exploration and interaction.

## Project Status
- **(✓_✓) Boot Sequence**
  - POST message generation
  - ASCII art rendering
  - Haiku generation

- **(✓_✓) Error Handling**
  - Error boundary implementation
  - Visual error states
  - Recovery system
  - Error logging
  - Fallback content

- **(✓_✓) Main Loop**
  - Chat controller
  - Command processing
  - Document retrieval
  - Vector search integration
  - Response generation

- **(✗_✗) Testing**
  - Manual Testing Complete
  - TODO: Automated testing suite

## Architecture

### Core Components

#### Terminal System
- `CogitationTerminal`: Main component orchestrating the terminal experience
- `TerminalFrame`: Responsive container with CRT effects, links to additional resources
- Controller-based architecture for state management
- Event queue system for operation sequencing

#### Controllers
1. **Boot Controller**
   - Handles startup sequence
   - ASCII art rendering
   - System initialization
   - State transitions

2. **Chat Controller**
   - Command processing
   - History management
   - Document retrieval
   - Search functionality
   - Special commands

#### State Management
```typescript
interface TerminalState {
  mode: 'NORMAL' | 'ERROR' | 'RECOVERY';
  designatedController: 'boot' | 'chat' | null;
  isLocked: boolean;
  isLoading: boolean;
  isFocused: boolean;
  error: Error | null;
}
```

### Key Features

#### Visual Effects
- Authentic CRT screen simulation
- Scanline effects
- Screen noise
- Text glow
- Flicker effects

#### Terminal Features
- ASCII art support
- Slash commands
- Command history
- Loading indicators
- Error visualization

#### AI Integration
- Claude API integration
- Vector search capabilities
- Context-aware interactions

### Technical Stack
- Next.js 12
- TypeScript
- React 17
- CSS Modules
- Claude Typescript SDK
- FAISS

### API Endpoints

```
POST /api/chat/message     - Process chat messages
GET  /api/boot/sequence    - Generate boot sequence
GET  /api/chat/documents   - Retrieve documents
GET  /api/chat/experience  - Get experience data
```

### Commands
```bash
  Power User Commands:
  /search <type> <text>  - Vector search
    ↳ <type>: none, query, document
       • none: Direct vector encoding, no special instructions
       • query: <text> is treated as a question, vectors in DB answer it
       • document: Uses HyDE (Hypothetical Document Embedding)
  /exp <type>  - Experience documents
    ↳ <type>: list, years, skills
       • list: List all experience docs
       • years: Filter by years of experience
       • skills: Filter by specific skills
  /other <subtype>  - Retrieve other document types
    ↳ <subtype>: cover-letter, publication-speaking, recommendation, thought-leadership
       • cover-letter: Generate or retrieve cover letters
       • publication-speaking: Documents related to publications or speaking engagements
       • recommendation: Generate or retrieve recommendation documents
       • thought-leadership: Thought leadership-related documents
  /project <command>  - Project operations
    ↳ <command>: list, type <subtype>, active
       • list: List all projects
       • type <subtype>: Filter projects by subtype
         ↳ <subtype>: product, process, infrastructure, self_referential
            • product: Projects related to product development
            • process: Process improvement projects
            • infrastructure: Infrastructure-related projects
            • self_referential: Projects about improving the system itself
       • active: Show active projects
  /resume  - Start resume generator
  
  System Commands:
  /clear  - Clear terminal
  /status  - Show system status
  /history [count]  - Display command history
  /help  - Display this help message
```

### Styling Architecture
- Modular CSS with CSS Modules
- Dynamic theme configuration
- Responsive design
- Mobile orientation handling
- CRT effect layering

### Error Handling
- Centralized error management
- Visual error states
- Recovery system
- Fallback content
- Error logging

## Development

### Prerequisites
```bash
Node.js >= 16
npm >= 7
```

### Setup
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Environment Variables
```bash
VECTOR_API_URL=http://localhost:8000
ANTHROPIC_API_KEY=sk-ant-xxxx
PORT=3000 # Optional
```

## Project Structure
```
virtualis-terminal/
├── components/        # Contains reusable React components
│   └── Terminal/      # Terminal-specific components and logic
│       ├── utils/        # Utility functions for terminal operations
│       ├── types/        # Type definitions related to Terminal
│       ├── styles/       # Styling for Terminal components
│       ├── handlers/     # Event and state handlers
│       ├── controllers/  # Logic controllers for terminal interactions
│       └── config/       # Configuration files for terminal behavior
├── pages/            # Next.js page components
│   ├── utils/        # Page-specific utilities
│   ├── fonts/        # Font assets
│   └── api/          # API routes
│       ├── chat/         # Chat-related API endpoints
│       └── boot/         # Boot sequence API endpoints
├── lib/              # Core utilities and business logic
│   ├── threads/      # Thread management utilities
│   ├── prompts/      # AI prompt structures
│   ├── mock/         # Mock data for testing
│   ├── fallbacks/    # Fallback logic and defaults
│   └── api/          # API request handling utilities
├── prisma/           # Prisma ORM-related files
│   ├── sessions/     # Database sessions management
│   └── migrations/   # Database migration scripts
├── public/           # Static assets (images, fonts, etc.)
├── sessions/         # Active session management
├── styles/           # Global styling
└── types/            # Shared TypeScript type definitions

```

## Code Style
- Strict TypeScript
- ESLint configuration
- Prettier formatting