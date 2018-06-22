const AWS = require('aws-sdk');
const rds = new AWS.RDS();
const sns = new AWS.SNS();

const cluster = process.env.CLUSTER_ID
const ttl = process.env.TIME_TO_LIVE;
const ttlMetric = process.env.TIME_TO_LIVE_METRIC
const prefix = `snapper-${ttl}-${ttlMetric}-${cluster}`

exports.handler = async (event) => {

    // create new snapshot
    var newSnapshot = await exports.createClusterSnapshot().catch((err) => { exports.error(err) });

    // grab current list of snapshots
    let snapshots = await exports.getSnapshots().catch((err) => { exports.error(err) });

    // create a list of prune requests
    let pruneRequests = exports.pruneSnapshots(snapshots.DBClusterSnapshots);

    // delete snapshots according to criteria
    let deletedSnaps = await Promise.all(pruneRequests).catch((err) => { exports.error(err) });

    // success
    return exports.success({ "New-Snapshot": newSnapshot, "DeletedSnapshots": deletedSnaps });
};

exports.success = (data) => {
    console.log(`Snapshot and Pruning COMPLETED for ${prefix}`);
    console.log(data);

    let snsParams = {
        Subject: `Snapshot and Pruning COMPLETED for ${prefix}`,
        Message: JSON.stringify(data),
        TopicArn: process.env.SNS_TOPIC_ARN
    }
    return sns.publish(snsParams).promise()
}

exports.error = (err) => {
    console.log(`Snapshot and Pruning FAILED for ${prefix}`);
    console.log(err);

    let snsParams = {
        Subject: `Snapshot and Pruning FAILED for ${prefix}`,
        Message: JSON.stringify(err)
    }
    return sns.publish(snsParams).promise()
}

exports.createClusterSnapshot = () => {
    let params = {
        DBClusterIdentifier: cluster,
        DBClusterSnapshotIdentifier: `${prefix}-${Date.now()}`,
        Tags: [{ Key: 'type', Value: 'snapper' }]
    }
    return rds.createDBClusterSnapshot(params).promise();
}

exports.getSnapshots = () => {
    let params = {
        DBClusterIdentifier: cluster,
        SnapshotType: 'manual'
    }
    return rds.describeDBClusterSnapshots(params).promise();
}

exports.pruneSnapshots = (snapshots) => {
    let prunedSnapShots = []
    snapshots.forEach(snap => {
        if (snap.DBClusterSnapshotIdentifier.toLowerCase().startsWith(prefix.toLowerCase())) {
            let createdDate = new Date(snap.SnapshotCreateTime);
            let oldestDate = new Date();
            let deleteSnap = false;

            switch (ttlMetric.toLowerCase()) {
                case 'second':
                    deleteSnap = createdDate < (oldestDate.setSeconds(oldestDate.getSeconds() - ttl))
                    break;
                case 'minute':
                    deleteSnap = createdDate < (oldestDate.setMinutes(oldestDate.getMinutes() - ttl))
                    break;
                case 'hour':
                    deleteSnap = createdDate < (oldestDate.setHours(oldestDate.getHours() - ttl))
                    break;
                case 'day':
                    deleteSnap = ((Date.now() - createdDate) / (1000 * 60 * 60 * 24)) > ttl
                    break;
                default:
                    deleteSnap = false;
                    break;
            }

            if (deleteSnap) prunedSnapShots.push(exports.deleteSnapshot(snap.DBClusterSnapshotIdentifier))
        }
    })
    return prunedSnapShots
}

exports.deleteSnapshot = (snapshotID) => {
    return rds.deleteDBClusterSnapshot({ DBClusterSnapshotIdentifier: snapshotID }).promise();
}
