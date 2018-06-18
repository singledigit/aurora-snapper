const AWS = require('aws-sdk');
const rds = new AWS.RDS();

const cluster = 'aurora-db-cluster'
const ttl = 30;
const ttlMetric = 'minute'
const tags = [{ Key: 'type', Value: 'snapper' }]
const prefix = `snapper-${ttl}-${ttlMetric}-${cluster}`

exports.handler = async(event, context, callback) => {

    // create new snapshot
    var newSnapshot = await exports.createClusterSnapshot().catch((err) => { exports.error(callback, err) });

    // grab current list of snapshots
    let snapshots = await exports.getSnapshots().catch((err) => { exports.error(callback, err) });

    // create a list of prune requests
    let pruneRequests = exports.pruneSnapshots(snapshots.DBClusterSnapshots);

    // delete snapshots according to criteria
    let deletedSnaps = await Promise.all(pruneRequests).catch((err) => { exports.error(callback, err) });

    // return
    callback(null, {"New-Snapshot":newSnapshot, "DeletedSnapshots":deletedSnaps});
};

exports.error = (callback, err) => {
    callback(err);
}

exports.createClusterSnapshot = () => {
    let params = {
        DBClusterIdentifier: cluster,
        DBClusterSnapshotIdentifier: `${prefix}-${Date.now()}`,
        Tags: tags
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
        if (snap.DBClusterSnapshotIdentifier.startsWith(prefix)) {
            let createdDate = new Date(snap.SnapshotCreateTime);
            let oldestDate = new Date();
            let deleteSnap = false;

            switch (ttlMetric) {
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
