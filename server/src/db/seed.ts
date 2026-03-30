import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import bcrypt from 'bcrypt';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { Database } from './types';

const SALT_ROUNDS = 10;

const PRODUCTS = [
  { id: 1, name: 'Fjallraven - Foldsack No. 1 Backpack' },
  { id: 2, name: 'Mens Casual Premium Slim Fit T-Shirts' },
  { id: 3, name: 'Mens Cotton Jacket' },
  { id: 4, name: "John Hardy Women's Gold Dragon Bracelet" },
  { id: 5, name: 'Solid Gold Petite Micropave Diamond Ring' },
];

async function seed(): Promise<void> {
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    }),
  });

  try {
    console.log('Seeding database...\n');

    // Truncate all tables and reset sequence
    await sql`TRUNCATE notifications, replies, tickets, users CASCADE`.execute(
      db,
    );
    await sql`ALTER SEQUENCE ticket_display_id_seq RESTART WITH 1`.execute(db);
    console.log('Cleared existing data');

    // --- Users ---
    const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
    const customerPassword = await bcrypt.hash('customer123', SALT_ROUNDS);

    const [admin] = await db
      .insertInto('users')
      .values({
        email: 'admin@holon.com',
        name: 'Admin User',
        password: adminPassword,
        role: 'admin',
      })
      .returning('id')
      .execute();

    const [customer1] = await db
      .insertInto('users')
      .values({
        email: 'customer1@example.com',
        name: 'Alice Martin',
        password: customerPassword,
        role: 'customer',
      })
      .returning('id')
      .execute();

    const [customer2] = await db
      .insertInto('users')
      .values({
        email: 'customer2@example.com',
        name: 'Bob Johnson',
        password: customerPassword,
        role: 'customer',
      })
      .returning('id')
      .execute();

    console.log('Created 3 users (1 admin, 2 customers)');

    // --- Tickets ---
    const ticketData = [
      {
        user: customer1,
        email: 'customer1@example.com',
        name: 'Alice Martin',
        product: PRODUCTS[0],
        subject: 'Backpack zipper broken on arrival',
        message:
          'I received my Fjallraven backpack yesterday and the main zipper is completely broken. It does not close at all. I would like a replacement or refund please.',
        status: 'open',
        priority: 'high',
      },
      {
        user: customer1,
        email: 'customer1@example.com',
        name: 'Alice Martin',
        product: PRODUCTS[1],
        subject: 'Wrong size received',
        message:
          'I ordered a Medium but received a Small. The order confirmation shows Medium. Can you send the correct size?',
        status: 'open',
        priority: 'medium',
      },
      {
        user: customer1,
        email: 'customer1@example.com',
        name: 'Alice Martin',
        product: PRODUCTS[2],
        subject: 'Color does not match product photo',
        message:
          'The jacket color is much darker than shown in the product photos. Is this normal or did I receive the wrong item?',
        status: 'closed',
        priority: 'low',
      },
      {
        user: customer2,
        email: 'customer2@example.com',
        name: 'Bob Johnson',
        product: PRODUCTS[3],
        subject: 'Bracelet clasp not working',
        message:
          'The clasp on the bracelet keeps opening on its own. This is a safety issue as I almost lost it twice already.',
        status: 'open',
        priority: 'high',
      },
      {
        user: customer2,
        email: 'customer2@example.com',
        name: 'Bob Johnson',
        product: PRODUCTS[4],
        subject: 'Ring size guide inaccurate',
        message:
          'I followed the size guide and ordered size 7, but the ring is way too tight. Your size guide might need updating.',
        status: 'open',
        priority: 'medium',
      },
      {
        user: customer2,
        email: 'customer2@example.com',
        name: 'Bob Johnson',
        product: PRODUCTS[0],
        subject: 'Delivery took too long',
        message:
          'My order was supposed to arrive in 5 business days but it took 3 weeks. I would like compensation for the delay.',
        status: 'closed',
        priority: 'low',
      },
      {
        user: customer1,
        email: 'customer1@example.com',
        name: 'Alice Martin',
        product: PRODUCTS[4],
        subject: 'Missing gift wrapping',
        message:
          'I paid extra for gift wrapping but the package arrived without it. I need this resolved before the birthday this weekend.',
        status: 'open',
        priority: 'medium',
      },
    ];

    const tickets = [];
    for (const t of ticketData) {
      const [ticket] = await db
        .insertInto('tickets')
        .values({
          user_id: t.user.id,
          email: t.email,
          name: t.name,
          product_id: t.product.id,
          product_name: t.product.name,
          subject: t.subject,
          message: t.message,
          status: t.status,
          priority: t.priority,
        })
        .returning(['id', 'display_id'])
        .execute();
      tickets.push({ ...ticket, data: t });
    }

    console.log(`Created ${tickets.length} tickets (TK-0001 to TK-${String(tickets.length).padStart(4, '0')})`);

    // --- Replies ---
    const replyTemplates = [
      // Ticket 0: Backpack zipper (open, high)
      [
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            "Hi Alice, I'm sorry to hear about the broken zipper. Could you please send us a photo of the damage so we can process this quickly?",
        },
        {
          userId: customer1.id,
          authorType: 'customer',
          message:
            "Sure, I've attached a photo. You can clearly see the zipper teeth are misaligned and the pull tab is bent.",
        },
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            "Thank you for the photo. I've approved a replacement shipment. You should receive the new backpack within 3-5 business days. No need to return the damaged one.",
        },
      ],
      // Ticket 1: Wrong size (open, medium)
      [
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            "Hi Alice, I can see the mix-up in our system. We'll send you the correct Medium size right away. Please return the Small using the prepaid label we'll email you.",
        },
        {
          userId: customer1.id,
          authorType: 'customer',
          message:
            'Thank you for the quick response! I received the return label. Shipping it back today.',
        },
      ],
      // Ticket 2: Color mismatch (closed, low)
      [
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            "Hi Alice, the color variation you're seeing is within the normal range for this product. The photos are taken under studio lighting which can make colors appear slightly different. Would you like to initiate a return?",
        },
        {
          userId: customer1.id,
          authorType: 'customer',
          message:
            "I see, that makes sense. I'll keep the jacket, the color has grown on me. Thanks for explaining!",
        },
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            "Glad to hear that! I'll close this ticket. Don't hesitate to reach out if you need anything else.",
        },
      ],
      // Ticket 3: Bracelet clasp (open, high)
      [
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            "Hi Bob, that sounds like a manufacturing defect. For safety reasons, please stop wearing the bracelet immediately. We'll send a replacement with an upgraded clasp mechanism.",
        },
        {
          userId: customer2.id,
          authorType: 'customer',
          message:
            "I've taken it off. How long will the replacement take? I bought this as an anniversary gift and I need it soon.",
        },
      ],
      // Ticket 4: Ring size (open, medium)
      [
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            "Hi Bob, I'm sorry about the sizing issue. We've had a few reports about this and are updating the size guide. Would you like to exchange for a size 8?",
        },
        {
          userId: customer2.id,
          authorType: 'customer',
          message:
            'Yes please, size 8 would be great. Can I keep the size 7 until the new one arrives?',
        },
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            "Absolutely, keep the size 7 until you receive the size 8. We'll include a prepaid return label with the new ring.",
        },
      ],
      // Ticket 5: Delivery delay (closed, low)
      [
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            "Hi Bob, I apologize for the delay. There was a logistics issue with our shipping partner. We've applied a 15% discount code to your account for future purchases: SORRY15.",
        },
        {
          userId: customer2.id,
          authorType: 'customer',
          message:
            'I appreciate the discount code. Hopefully future deliveries will be on time. Thank you.',
        },
      ],
      // Ticket 6: Missing gift wrapping (open, medium)
      [
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            'Hi Alice, I apologize for the missing gift wrapping. We can either refund the gift wrapping fee or send you a complimentary gift box with ribbon via express shipping. Which would you prefer?',
        },
        {
          userId: customer1.id,
          authorType: 'customer',
          message:
            'The express gift box sounds great! The birthday is on Saturday so I need it by Friday at the latest.',
        },
        {
          userId: admin.id,
          authorType: 'agent',
          message:
            "I've arranged overnight shipping for the gift box. You should receive it by Thursday. I've also refunded the original gift wrapping fee as a courtesy.",
        },
      ],
    ];

    let replyCount = 0;
    for (let i = 0; i < tickets.length; i++) {
      for (const reply of replyTemplates[i]) {
        await db
          .insertInto('replies')
          .values({
            ticket_id: tickets[i].id,
            user_id: reply.userId,
            author_type: reply.authorType,
            message: reply.message,
          })
          .execute();
        replyCount++;
      }
    }

    console.log(`Created ${replyCount} replies across ${tickets.length} tickets`);

    // --- Notifications ---
    const notifications: Array<{
      user_id: string;
      type: string;
      ticket_id: string;
      message: string;
      read: boolean;
    }> = [];

    for (const ticket of tickets) {
      // new_ticket notification for admin
      notifications.push({
        user_id: admin.id,
        type: 'new_ticket',
        ticket_id: ticket.id,
        message: `New ticket ${ticket.display_id}: ${ticket.data.subject}`,
        read: true,
      });

      // new_reply notification for the ticket owner (from agent replies)
      notifications.push({
        user_id: ticket.data.user.id,
        type: 'new_reply',
        ticket_id: ticket.id,
        message: `New reply on ${ticket.display_id} from support agent`,
        read: false,
      });
    }

    // ticket_closed notifications for closed tickets
    const closedTickets = tickets.filter((t) => t.data.status === 'closed');
    for (const ticket of closedTickets) {
      notifications.push({
        user_id: ticket.data.user.id,
        type: 'ticket_closed',
        ticket_id: ticket.id,
        message: `Ticket ${ticket.display_id} has been closed`,
        read: false,
      });
    }

    await db.insertInto('notifications').values(notifications).execute();

    console.log(`Created ${notifications.length} notifications`);
    console.log('\nSeed completed successfully!');
    console.log('\nDefault accounts:');
    console.log('  Admin:      admin@holon.com / admin123');
    console.log('  Customer 1: customer1@example.com / customer123');
    console.log('  Customer 2: customer2@example.com / customer123');
  } catch (error) {
    console.error('Seed failed');
    console.error(error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

seed();
