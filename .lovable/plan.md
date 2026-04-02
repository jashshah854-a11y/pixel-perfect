

# Fix Empty Office Rooms — Match Real Agent Departments

## Problem
The office scene hardcodes 6 department names (`Dev`, `Design`, `Planning`, `Operations`, `QA`, `DevSecOps`) but the actual agents in the database have different departments: `Orchestration`, `Architecture`, `UI/UX`, `Research`, `Review` (×2), `DevOps`. Zero agents match → all rooms appear empty with no figures.

## Fix

### `src/components/office-view/officeScene.ts`
Update the `DEPARTMENTS` array to match the real database values:

| Old | New | Tint |
|-----|-----|------|
| Dev | Orchestration | blue |
| Design | Architecture | purple |
| Planning | UI/UX | amber |
| Operations | Research | green |
| QA | Review | cyan |
| DevSecOps | DevOps | rose |

This single change makes all 7 agents appear at their desks with chairs, monitors, coffee mugs, status dots, name labels, and all existing animations (bobbing, aura pulse, breathing).

### No other changes needed
- Drawing functions already work (desks, agents, chairs, beds all render correctly)
- Ticker animations already target the agent sprites
- Coffee steam particles and monitor glow already reference the correct data structures

