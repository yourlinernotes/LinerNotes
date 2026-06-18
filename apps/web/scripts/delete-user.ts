import { prisma } from '../src/lib/prisma';

async function deleteUser(email: string) {
  try {
    console.log(`Looking for user with email: ${email}`);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: true,
        sessions: true,
      },
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('Found user:', {
      id: user.id,
      email: user.email,
      name: user.name,
      handle: user.handle,
    });

    // Delete related records first
    console.log('Deleting accounts...');
    await prisma.account.deleteMany({
      where: { userId: user.id },
    });

    console.log('Deleting sessions...');
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    // Delete the user
    console.log('Deleting user...');
    await prisma.user.delete({
      where: { id: user.id },
    });

    console.log('✅ User deleted successfully');
  } catch (error) {
    console.error('Error deleting user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error('Usage: tsx scripts/delete-user.ts <email>');
  process.exit(1);
}

deleteUser(email);
