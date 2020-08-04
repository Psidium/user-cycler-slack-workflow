import * as AWS from "aws-sdk";

export class Dynamo {
  dynamo: AWS.DynamoDB.DocumentClient;
  constructor() {
    this.dynamo = new AWS.DynamoDB.DocumentClient();
  }

  /**
   * Dynamo Save
   *
   * @param {Object} data - The data to save
   * @return {Promise} A Promise with the save results
   */
  public save(data: { id: string; } & any) {
    const params = {
      TableName: this.getTableName(),
      Item: data,
    };
    return this.dynamo.put(params).promise();
  }

  /**
   * Dynamo Get
   *
   * @param {String} id - The record's key
   * @return {Promise} A Promise with the get result
   */
  public async get(id) {
    const res = await this.dynamo
      .get({
        TableName: this.getTableName(),
        Key: { id: id },
      })
      .promise();
    return res.Item;
  }

  private getTableName(): string {
    return process.env.TABLE_NAME || "";
  }
}

export const dynamo = new Dynamo();
