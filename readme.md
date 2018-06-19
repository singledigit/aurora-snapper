# Aurora Snapper

This is a simple peice of code to help automate manual snapshots on Aurora. These snapshots can be saved beyond the standard 35 day window.

## Pre-Requisites
1. An AWS account with admin access rights.
2. AWS CLI installed and configured. Instructions can be found [here](https://docs.aws.amazon.com/cli/latest/userguide/installing.html).
3. Node 8+ to test locally but not required

## Setup
1. Clone this repo locally `git clone https://github.com/singledigit/aurora-snapper`
2. Change to the downloaded directory and install dependencies using `npm install`
3. Create a unique bucket to upload the code to. `aws s3api create-bucket --bucket <your unique bucket name>`

## Update Variables
1. Copy and rename function as many times as needed
2. Change *Frquency*, *Time To Live*, and *Time To Live Metrics* variables

## Deployment
Code deployment consists of two commands. The first command will package up your code and copy it to the bucket you created. The second will deploy your new lambda.

1. **Package:** `aws cloudformation package --template-file ./template.yaml --s3-bucket <your unique bucket name>`
2. **Deploy:** `aws cloudformation deploy --template-file ./out.yaml --stack-name AuroraSnapper --capabilities CAPABILITY_IAM --parameter-overrides ClusterId=<Your DB Cluster Name>`