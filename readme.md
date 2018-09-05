# Aurora Snapper
**Github:** https://github.com/singledigit/aurora-snapper

This is a simple peice of code to help automate manual snapshots on Aurora. These snapshots can be saved beyond the standard 35 day window.

## Pre-Requisites
1. An AWS account with admin access rights.
2. AWS CLI installed and configured. Instructions can be found [here](https://docs.aws.amazon.com/cli/latest/userguide/installing.html).

## Setup
1. If pulling from github, clone this repo and `cd` to cloned directory
2. Create a unique bucket to upload the code to.
```
aws s3api create-bucket --bucket <your unique bucket name>
```

## Parameters
- **ClusterId**: The ID of the Aurora cluster to be snapped
- **Chron**: Chron string to set how oftenthe snapshot should be taken. The default is every 7 days. Examples: *rate(30 minutes) | rate(1 hour) | rate(7 days)] Default is rate(7 days)*
- **TTLMetric**: The metric to use when setting your Time To Live (TTL). The default is Month. Examples: *Second | Minute | Hour | Day | Month*
- **TTL**: Number of TTYL units. The default is 12. This plus TTLMetric would be a default of 12 months for saving the snapshots
- **BrodcastOnSuccess**: Whether to broadcast to SNS topic on success or not. The dafault is false

## Deployment
Code deployment consists of two commands. The first command will package up your code and copy it to the bucket you created. The second will deploy your new lambda.

1. **Package:**
```
aws cloudformation package --template-file ./template.yaml --output-template-file ./out.yaml --s3-bucket <your unique bucket name>
```
2. **Deploy:**
```
aws cloudformation deploy --template-file ./out.yaml --stack-name AuroraSnapper --capabilities CAPABILITY_IAM --parameter-overrides ClusterId=<Your DB Cluster Name> <any other overrides>
```

## Post Deployment
1. Run following command to get Topic Arn for messaging. 
```
aws cloudformation describe-stacks --stack-name AuroraSnapper --query 'Stacks[0].Outputs[?OutputKey==`BroadcastTopicArn`].OutputValue' --output text
```
2. Make note of the returned Topic Arn. Something like: *arn:aws:sns:us-east-1:1122334455:AuroraSnapper-SNSBroadcast-111111111*
3. Use following commands to subscribe to broadcast messaging

**Email**
```
aws sns subscribe --topic-arn <Your Topic Arn> --protocol email --notification-endpoint <Your Email>
```

**SMS**
```
aws sns subscribe --topic-arn <Your Topic Arn> --protocol sms --notification-endpoint <Your Phone Number. Format: +15554441515>
```

## Cleanup ##
To delete AuroraSnapper run the following command.
```
aws cloudformation delete-stack --stack-name AuroraSnapper
```

## Note After Cleanup ##
* Snapshots must be manually pruned.
* Bucket must me manually deleted

## Disclaimer ##
**The author is not responsible for any loss of data or charges incurred while using this utility.**