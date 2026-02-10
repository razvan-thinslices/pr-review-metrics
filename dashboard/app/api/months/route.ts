import { readdir } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const outputDir = join(process.cwd(), '../output')
    const files = await readdir(outputDir)
    
    const months = files
      .filter(f => f.match(/^pr-reviews-\d{4}-\d{2}\.json$/))
      .map(f => f.replace('pr-reviews-', '').replace('.json', ''))
      .sort()
      .reverse() // Most recent first
    
    return NextResponse.json({ months })
  } catch (error) {
    console.error('Error reading months:', error)
    return NextResponse.json({ months: [] })
  }
}
