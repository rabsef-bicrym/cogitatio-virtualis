# COGITATIO VIRTUALIS - Cogitation Terminal

A neural terminal interface merging traditional command-line aesthetics with modern AI capabilities. The Cogitation Terminal provides a retro-futuristic interface for AI-powered document exploration and interaction.

## Project Status
- 🟢 **Boot Sequence**: Complete
  - ASCII art rendering
  - Boot message generation
  - Haiku generation
  - State transitions
  - CRT effects

- 🟢 **Error Handling [Basic]**: Complete
  - Error boundary implementation
  - Visual error states
  - Recovery system
  - Error logging
  - Fallback content

- 🟡 **Main Loop**: In Progress
  - Chat controller ✓
  - Command processing ✓
  - Document retrieval ✓
  - Vector search integration ⚠️
  - Response generation ⚠️

- 🔴 **Testing**: Not Started
  - No testing infrastructure currently implemented

## Architecture

### Core Components

#### Terminal System
- `CogitationTerminal`: Main component orchestrating the terminal experience
- `TerminalFrame`: Responsive container with CRT effects
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
- Command history
- Tab completion (planned)
- Rich text formatting
- ASCII art support
- Loading indicators
- Error visualization

#### AI Integration
- Claude API integration
- Vector search capabilities
- Dynamic response generation
- Context-aware interactions
- Professional document analysis

### Technical Stack
- Next.js 12
- TypeScript
- React 17
- CSS Modules
- Claude API
- Vector Search

### API Endpoints

```
POST /api/chat/message     - Process chat messages
GET  /api/boot/sequence    - Generate boot sequence
GET  /api/chat/documents   - Retrieve documents
GET  /api/chat/experience  - Get experience data
```

### Commands
```bash
# System Commands
/clear            - Clear terminal
/status           - Show system status
/history [count]  - Show command history

# Document Commands
/docs <type>      - Get documents by type
/project list     - List all projects
/exp list         - List experience
/search <query>   - Vector search
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
cogitatio-terminal/
├── components/       # React components
│   └── Terminal/    # Terminal components
├── pages/           # Next.js pages
├── lib/             # Utilities
├── styles/          # Global styles
└── types/           # TypeScript types
```

## Upcoming Features

### Short Term
- Enhanced error visualization
- Resume printing
- Session persistence

### Medium Term
- History search
- More terminal effects
- Custom themes (or themes at all??)
- Enhanced vector search

### Long Term
- Custom animations
- Extended AI capabilities
- Performance optimizations

## Code Style
- Strict TypeScript
- ESLint configuration
- Prettier formatting

## Credits
Original concept and ASCII art effects by PokeClaude.
Terminal aesthetic inspired by classic CRT displays.