import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ month: string }> }
) {
  try {
    const { month } = await context.params
    
    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      )
    }
    
    const filePath = join(process.cwd(), '../output', `pr-reviews-${month}.json`)
    const data = await readFile(filePath, 'utf-8')
    
    return NextResponse.json(JSON.parse(data))
  } catch (error) {
    console.error('Error reading data:', error)
    return NextResponse.json(
      { error: 'Data not found for this month' },
      { status: 404 }
    )
  }
}
