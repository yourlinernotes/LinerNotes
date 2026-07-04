import { prisma } from '../src/lib/prisma';

async function deleteUser(handleOrEmail: string) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { handle: handleOrEmail },
          { email: handleOrEmail },
        ],
      },
      omit: { email: false }, // admin script needs to display the email
    });

    if (!user) {
      console.log(`❌ User not found: ${handleOrEmail}`);
      return;
    }

    console.log(`Found user:`, {
      id: user.id,
      email: user.email,
      handle: user.handle,
      displayName: user.displayName,
    });

    console.log('\n🗑️  Deleting user data...');

    const reviewsDeleted = await prisma.review.deleteMany({ where: { userId: user.id } });
    console.log(`  ✓ Deleted ${reviewsDeleted.count} reviews`);

    const accountsDeleted = await prisma.account.deleteMany({ where: { userId: user.id } });
    console.log(`  ✓ Deleted ${accountsDeleted.count} OAuth accounts`);

    const sessionsDeleted = await prisma.session.deleteMany({ where: { userId: user.id } });
    console.log(`  ✓ Deleted ${sessionsDeleted.count} sessions`);

    await prisma.user.delete({ where: { id: user.id } });

    console.log(`\n✅ Deleted user: ${user.handle}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUser(process.argv[2] || 'anushaisawesome');
