import { NextResponse } from 'next/server';

let users = [];

export async function GET() {
    return NextResponse.json(users);
}

export async function POST(request) {
    const user = await request.json();
    users.push(user);
    return NextResponse.json(user, { status: 201 });
}