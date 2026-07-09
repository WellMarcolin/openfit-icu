import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkoutDialog } from './WorkoutDialog'

describe('WorkoutDialog', () => {
  it('renders steps section for new workout', () => {
    render(<WorkoutDialog onSave={() => {}} open={true} onOpenChange={() => {}} />)
    expect(screen.getByText('+ Add step')).toBeDefined()
  })
})
