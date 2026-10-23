// Generates public/sample-exam.csv: 65 Cloud Practitioner-style questions (60 single answer,
// 5 "choose two") built from a table of AWS service facts. Deterministic, so re-running
// produces the same file. It exists to demo the CSV format and exercise the app;
// replace it with your own question set for real practice.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng, shuffle } from '../src/lib/rng.js';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/sample-exam.csv');

// [name, category, description completing "Which AWS service ...?"]
const S = [
  ['Amazon S3', 'storage', 'provides object storage built to store and retrieve any amount of data from anywhere'],
  ['Amazon EBS', 'storage', 'provides persistent block storage volumes for use with Amazon EC2 instances'],
  ['Amazon EFS', 'storage', 'provides a simple, serverless, elastic NFS file system for Linux-based workloads'],
  ['Amazon S3 Glacier', 'storage', 'provides low-cost, long-term archival storage for data that is rarely accessed'],
  ['AWS Storage Gateway', 'storage', 'connects on-premises applications to cloud-backed storage as a hybrid storage service'],
  ['AWS Backup', 'storage', 'centralizes and automates data backup across AWS services'],

  ['Amazon EC2', 'compute', 'provides resizable virtual servers in the cloud'],
  ['AWS Lambda', 'compute', 'runs code in response to events without provisioning or managing servers'],
  ['AWS Elastic Beanstalk', 'compute', 'deploys and scales web applications when you simply upload your code'],
  ['Amazon Lightsail', 'compute', 'offers virtual private servers with simple, predictable pricing for small projects'],
  ['AWS Fargate', 'compute', 'runs containers without requiring you to manage servers or clusters of EC2 instances'],
  ['Amazon ECS', 'compute', 'is a fully managed container orchestration service for running Docker containers'],
  ['Amazon EKS', 'compute', 'runs managed Kubernetes on AWS'],
  ['AWS Outposts', 'compute', 'extends AWS infrastructure and services to on-premises facilities'],
  ['Amazon EC2 Auto Scaling', 'compute', 'adjusts the number of EC2 instances automatically according to conditions you define'],

  ['Amazon RDS', 'database', 'makes it easy to set up, operate, and scale managed relational databases'],
  ['Amazon Aurora', 'database', 'is a MySQL- and PostgreSQL-compatible relational database built for the cloud'],
  ['Amazon DynamoDB', 'database', 'is a fully managed NoSQL key-value and document database with single-digit millisecond performance'],
  ['Amazon ElastiCache', 'database', 'provides managed in-memory data stores for caching, compatible with open-source engines such as Redis and Memcached'],
  ['Amazon Neptune', 'database', 'is a fully managed graph database service'],

  ['Amazon VPC', 'networking', 'lets you provision a logically isolated virtual network in the AWS Cloud'],
  ['Amazon Route 53', 'networking', 'is a scalable Domain Name System (DNS) web service'],
  ['Amazon CloudFront', 'networking', 'is a content delivery network (CDN) that delivers content with low latency through edge locations'],
  ['AWS Direct Connect', 'networking', 'establishes a dedicated private network connection from your premises to AWS'],
  ['AWS Transit Gateway', 'networking', 'connects VPCs and on-premises networks through a central hub'],
  ['Amazon API Gateway', 'networking', 'lets you create, publish, and manage APIs at any scale'],
  ['Elastic Load Balancing', 'networking', 'automatically distributes incoming traffic across multiple targets'],
  ['AWS Site-to-Site VPN', 'networking', 'creates an encrypted connection between your network and your VPCs over the internet'],

  ['AWS IAM', 'security', 'controls access to AWS services and resources through users, roles, and policies'],
  ['AWS KMS', 'security', 'creates and controls the cryptographic keys used to encrypt your data'],
  ['AWS Secrets Manager', 'security', 'helps you store, rotate, and retrieve secrets such as database credentials'],
  ['AWS WAF', 'security', 'protects web applications from common web exploits using customizable rules'],
  ['AWS Shield', 'security', 'provides managed protection against DDoS attacks'],
  ['Amazon GuardDuty', 'security', 'continuously monitors for malicious activity and unauthorized behavior using threat intelligence'],
  ['Amazon Inspector', 'security', 'automatically scans workloads for software vulnerabilities and unintended network exposure'],
  ['Amazon Macie', 'security', 'uses machine learning to discover and protect sensitive data stored in Amazon S3'],
  ['Amazon Cognito', 'security', 'adds user sign-up, sign-in, and access control to web and mobile apps'],
  ['AWS Artifact', 'security', 'provides on-demand access to AWS compliance reports and agreements'],

  ['Amazon CloudWatch', 'management', 'collects metrics and logs and lets you set alarms to monitor your resources'],
  ['AWS CloudTrail', 'management', 'records account activity and API calls for governance and auditing'],
  ['AWS CloudFormation', 'management', 'provisions resources from templates using infrastructure as code'],
  ['AWS Config', 'management', 'records and evaluates the configuration of your AWS resources against desired settings'],
  ['AWS Systems Manager', 'management', 'gives you operational insight and lets you automate tasks across your AWS resources'],
  ['AWS Organizations', 'management', 'lets you centrally manage and govern multiple AWS accounts'],
  ['AWS Control Tower', 'management', 'sets up and governs a secure multi-account AWS environment'],
  ['AWS Trusted Advisor', 'support', 'inspects your environment and recommends best practices for cost, performance, security, and fault tolerance'],

  ['AWS Cost Explorer', 'billing', 'lets you visualize, understand, and manage your AWS costs and usage over time'],
  ['AWS Budgets', 'billing', 'lets you set custom cost and usage budgets and receive alerts when thresholds are exceeded'],

  ['Amazon Athena', 'analytics', 'lets you query data in Amazon S3 using standard SQL without managing servers'],
  ['AWS Glue', 'analytics', 'is a serverless data integration service used to discover, prepare, and transform data for analytics'],
  ['Amazon EMR', 'analytics', 'runs big data frameworks such as Apache Hadoop and Spark on managed clusters'],
  ['Amazon Kinesis Data Streams', 'analytics', 'collects and processes large streams of data records in real time'],
  ['Amazon QuickSight', 'analytics', 'is a business intelligence service for building interactive dashboards'],
  ['Amazon Redshift', 'analytics', 'is a fully managed, petabyte-scale cloud data warehouse'],

  ['Amazon SQS', 'integration', 'is a fully managed message queuing service that decouples application components'],
  ['Amazon SNS', 'integration', 'is a publish/subscribe messaging and notification service'],
  ['Amazon EventBridge', 'integration', 'is a serverless event bus that connects applications using events'],
  ['AWS Step Functions', 'integration', 'orchestrates serverless workflows by coordinating multiple AWS services'],

  ['Amazon SageMaker', 'ml', 'lets you build, train, and deploy machine learning models'],
  ['Amazon Rekognition', 'ml', 'analyzes images and videos to identify objects, people, and text'],
  ['Amazon Polly', 'ml', 'converts text into lifelike speech'],
  ['Amazon Transcribe', 'ml', 'converts speech to text'],
  ['Amazon Translate', 'ml', 'provides neural machine translation between languages'],
  ['Amazon Comprehend', 'ml', 'uses natural language processing to extract insights from text'],
  ['Amazon Lex', 'ml', 'builds conversational chatbots using voice and text'],
  ['Amazon Textract', 'ml', 'extracts printed text, handwriting, and data from scanned documents'],
  ['Amazon Bedrock', 'ml', 'provides access to foundation models through a single API for building generative AI applications'],

  ['AWS Database Migration Service', 'migration', 'helps you migrate databases to AWS quickly and securely'],
  ['AWS DataSync', 'migration', 'automates and accelerates moving data between on-premises storage and AWS storage services'],
  ['AWS Transfer Family', 'migration', 'provides secure file transfers into and out of AWS storage using SFTP, FTPS, and FTP'],

  ['Amazon WorkSpaces', 'other', 'provides managed, secure virtual desktops in the cloud'],
];

const DOMAIN = {
  security: 'Security and Compliance',
  billing: 'Billing, Pricing, and Support',
  support: 'Billing, Pricing, and Support',
};
const domainOf = (cat) => DOMAIN[cat] || 'Cloud Technology and Services';

// "choose two" questions: correct answers come from `pool`, wrong ones from other categories
const MULTI = [
  { label: 'storage', pool: ['Amazon S3', 'Amazon EBS', 'Amazon EFS', 'Amazon S3 Glacier'], wrongCats: ['compute', 'security', 'ml', 'integration', 'billing'] },
  { label: 'database', pool: ['Amazon RDS', 'Amazon Aurora', 'Amazon DynamoDB', 'Amazon Neptune'], wrongCats: ['compute', 'security', 'ml', 'integration', 'billing', 'networking'] },
  { label: 'security', pool: ['AWS IAM', 'AWS KMS', 'AWS WAF', 'AWS Shield', 'Amazon GuardDuty'], wrongCats: ['storage', 'compute', 'analytics', 'integration', 'billing'] },
  { label: 'machine learning', pool: ['Amazon SageMaker', 'Amazon Rekognition', 'Amazon Polly', 'Amazon Textract', 'Amazon Lex'], wrongCats: ['storage', 'compute', 'database', 'networking', 'billing'] },
  { label: 'networking and content delivery', pool: ['Amazon VPC', 'Amazon Route 53', 'Amazon CloudFront', 'AWS Direct Connect'], wrongCats: ['storage', 'compute', 'database', 'ml', 'billing'] },
];

const byName = new Map(S.map((s) => [s[0], s]));
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const rows = [];
let n = 0;

// 60 single-answer questions
const singles = shuffle(S, makeRng('sample#pick')).slice(0, 60);
for (const [name, cat, desc] of singles) {
  n += 1;
  const rng = makeRng(`sample#single#${n}`);
  const wrong = shuffle(S.filter((s) => s[1] !== cat), rng).slice(0, 3).map((s) => s[0]);
  const options = shuffle([name, ...wrong], rng);
  rows.push({
    id: n,
    domain: domainOf(cat),
    question: `Which AWS service ${desc}?`,
    options,
    answer: LETTERS[options.indexOf(name)],
    explanation: `${name} ${desc}.`,
  });
}

// 5 choose-two questions
for (const m of MULTI) {
  n += 1;
  const rng = makeRng(`sample#multi#${n}`);
  const right = shuffle(m.pool, rng).slice(0, 2);
  const wrong = shuffle(S.filter((s) => m.wrongCats.includes(s[1])), rng).slice(0, 3).map((s) => s[0]);
  const options = shuffle([...right, ...wrong], rng);
  rows.push({
    id: n,
    domain: domainOf(byName.get(right[0])[1]),
    question: `Which TWO of the following are AWS ${m.label} services? (Choose two.)`,
    options,
    answer: right.map((r) => LETTERS[options.indexOf(r)]).sort().join(','),
    explanation: `${right[0]} and ${right[1]} are ${m.label} services.`,
  });
}

const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
const header = ['id', 'domain', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'answer', 'explanation'];
const lines = [header.join(',')];
for (const r of rows) {
  const opts = LETTERS.map((_, i) => (r.options[i] ? q(r.options[i]) : ''));
  lines.push([r.id, q(r.domain), q(r.question), ...opts, q(r.answer), q(r.explanation)].join(','));
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`Wrote ${rows.length} questions to ${out}`);
