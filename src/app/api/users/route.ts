import { NextResponse, NextRequest } from 'next/server';

let users: unknown[] = [];

export async function GET() {
    return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
    const user: unknown = await request.json();
    users.push(user);
    return NextResponse.json(user, { status: 201 });
}