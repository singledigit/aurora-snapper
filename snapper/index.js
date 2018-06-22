const AWS = require('aws-sdk');
const rds = new AWS.RDS();
const sns = new AWS.SNS();
const prefix = `snapper-${process.env.TIME_TO_LIVE}-${process.env.TIME_TO_LIVE_METRIC}-${process.env.CLUSTER_ID}`

const createClusterSnapshot = () => {
    let params = {
        DBClusterIdentifier: process.env.CLUSTER_ID,
        DBClusterSnapshotIdentifier: `${prefix}-${Date.now()}`,
        Tags: [{ Key: 'type', Value: 'snapper' }]
    }
    return rds.createDBClusterSnapshot(params).promise();
}

const success = (data) => {
    console.log(`Snapshot and Pruning COMPLETED for ${prefix}`);
    console.log(data);

    if (process.env.BRODCAST_ON_SUCCESS) {
        let snsParams = {
            Subject: `Snapshot and Pruning COMPLETED for ${prefix}`,
            Message: JSON.stringify(data),
            TopicArn: process.env.SNS_TOPIC_ARN
        }
        return sns.publish(snsParams).promise()
    }
    else return Promise.resolve(data)
}

const errorHandler = (err) => {
    console.log(`Snapshot and Pruning FAILED for ${prefix}`);
    console.log(err);

    let snsParams = {
        Subject: `Snapshot and Pruning FAILED for ${prefix}`,
        Message: JSON.stringify(err)
    }
    return sns.publish(snsParams).promise()
}

const getSnapshots = () => {
    let params = {
        DBClusterIdentifier: process.env.CLUSTER_ID,
        SnapshotType: 'manual'
    }
    return rds.describeDBClusterSnapshots(params).promise();
}

const pruneSnapshots = (snapshots) => {
    return snapshots.map(snap => {
        if (snap.DBClusterSnapshotIdentifier.toLowerCase().startsWith(prefix.toLowerCase())) {
            let createdDate = new Date(snap.SnapshotCreateTime);
            let oldestDate = new Date();
            let deleteSnap = false;

            switch (process.env.TIME_TO_LIVE_METRIC.toLowerCase()) {
                case 'second':
                    deleteSnap = createdDate < (oldestDate.setSeconds(oldestDate.getSeconds() - process.env.TIME_TO_LIVE))
                    break;
                case 'minute':
                    deleteSnap = createdDate < (oldestDate.setMinutes(oldestDate.getMinutes() - process.env.TIME_TO_LIVE))
                    break;
                case 'hour':
                    deleteSnap = createdDate < (oldestDate.setHours(oldestDate.getHours() - process.env.TIME_TO_LIVE))
                    break;
                case 'day':
                    deleteSnap = ((Date.now() - createdDate) / (1000 * 60 * 60 * 24)) > process.env.TIME_TO_LIVE
                    break;
                default:
                    deleteSnap = false;
                    break;
            }

            if (deleteSnap) return rds.deleteDBClusterSnapshot({ DBClusterSnapshotIdentifier: snap.DBClusterSnapshotIdentifier }).promise()
        }
    })
}

exports.handler = async () => {
    try {
        // create new snapshot
        let newSnapshot = await createClusterSnapshot();

        // grab current list of snapshots
        let snapshots = await getSnapshots();

        // create a list of prune requests
        let pruneRequests = pruneSnapshots(snapshots.DBClusterSnapshots);

        // delete snapshots according to criteria
        let deletedSnaps = await Promise.all(pruneRequests)

        // success
        return success({ "New-Snapshot": newSnapshot, "DeletedSnapshots": deletedSnaps });
    }
    catch (err) {
        errorHandler(err);
    }
};