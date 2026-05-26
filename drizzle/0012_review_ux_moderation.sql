ALTER TABLE "Review" ADD COLUMN "isVerifiedBuyer" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "Review" ADD COLUMN "helpfulCount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "Review" ADD COLUMN "notHelpfulCount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "Review" ADD COLUMN "isFeatured" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "Review" ADD COLUMN "isHidden" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "ReviewVote" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"reviewId" varchar(7) NOT NULL,
	"userId" text NOT NULL,
	"vote" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ReviewVote_reviewId_userId_key" UNIQUE("reviewId","userId")
);
--> statement-breakpoint
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_Review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ReviewVote_reviewId_idx" ON "ReviewVote" USING btree ("reviewId");
--> statement-breakpoint
CREATE INDEX "ReviewVote_userId_idx" ON "ReviewVote" USING btree ("userId");
