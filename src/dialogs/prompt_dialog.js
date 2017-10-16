const Dialog = require('./dialog');

/**
 * PromptDialog class.
 */
class PromptDialog extends Dialog {
  constructor(config, brain, parameters) {
    super(config, brain, parameters);
    this.maxComplexity = Object.keys(parameters.entities).length + 1;
  }

  async computeMissingEntities(id, messageEntities) {
    console.log('PromptDialog.computeMissingEntities', messageEntities);
    const dialogEntities = await this.brain.conversationGet(id, this.parameters.namespace) || {};
    for (const messageEntity of messageEntities) {
      dialogEntities[messageEntity.dim] = messageEntity;
    }
    console.log('PromptDialog.computeMissingEntities: dialogEntities', dialogEntities);
    await this.brain.conversationSet(id, this.parameters.namespace, dialogEntities);
    return Object
      .keys(this.parameters.entities)
      .filter(entityKey => dialogEntities[entityKey] === undefined);
  }

  async executeWhenBlocked(id, responses, messageEntities) {
    console.log('PromptDialog.executeWhenBlocked', id, responses, messageEntities);
    this.askDialog(id, responses);
    return Dialog.STATUS_WAITING;
  }

  async executeWhenWaiting(id, responses, messageEntities) {
    console.log('PromptDialog.executeWhenWaiting');
    for (const messageEntity of messageEntities) {
      if (messageEntity.dim === 'system:boolean') {
        const booleanValue = messageEntity.values[0].value;
        console.log('PromptDialog.execute: system:boolean', booleanValue);
        if (booleanValue) {
          this.confirmDialog(id, responses);
          return this.executeWhenReady(id, responses, messageEntities);
        } else {
          this.discardDialog(id, responses);
          return Dialog.STATUS_DISCARDED;
        }
      }
    }
    return Dialog.STATUS_BLOCKED;
  }

  async executeWhenReady(id, responses, messageEntities) {
    console.log('PromptDialog.executeWhenReady');
    messageEntities = messageEntities
      .filter(entity => this.parameters.entities[entity.dim] !== undefined);
    this.confirmEntities(id, responses, messageEntities);
    const missingEntities = await this.computeMissingEntities(id, messageEntities);
    this.askEntities(id, responses, missingEntities);
    return missingEntities.length === 0 ? Dialog.STATUS_COMPLETED : Dialog.STATUS_READY;
  }

  /**
   * Executes.
   * @param {string} id the user id
   * @param {Object[]} responses
   * @param {Object[]} messageEntities - entities array from user message
   */
  async execute(id, responses, messageEntities, status) {
    console.log('PromptDialog.execute', id, responses, messageEntities, status);
    if (status === Dialog.STATUS_BLOCKED) {
      return this.executeWhenBlocked(id, responses, messageEntities);
    }
    if (status === Dialog.STATUS_WAITING) {
      return this.executeWhenWaiting(id, responses, messageEntities);
    }
    return this.executeWhenReady(id, responses, messageEntities);
  }

  askDialog(id, responses) {
    console.log('PromptDialog.askDialog', id, responses);
    this.pushMessages(responses, this.textMessages(id,
                                                   `${this.parameters.namespace}_ask`));
  }

  confirmDialog(id, responses) {
    console.log('PromptDialog.confirmDialog', id, responses);
    this.pushMessages(responses, this.textMessages(id,
                                                   `${this.parameters.namespace}_confirm`));
  }

  discardDialog(id, responses) {
    console.log('PromptDialog.discardDialog', id, responses);
    this.pushMessages(responses, this.textMessages(id,
                                                   `${this.parameters.namespace}_discard`));
  }

  askEntities(id, responses, entities) {
    console.log('PromptDialog.askEntities', id, responses, entities);
    // TODO: put all this in a single template
    for (const entityKey of entities) {
      this.pushMessages(responses, this.textMessages(id,
                                                     `${this.parameters.namespace}_${entityKey}_ask`,
                                                     { entity: entityKey }));
    }
  }

  confirmEntities(id, responses, entities) {
    console.log('PromptDialog.confirmEntities', id, responses, entities);
    // TODO: put all this in a single template
    for (const entity of entities) {
      this.pushMessages(responses, this.textMessages(id,
                                                     `${this.parameters.namespace}_${entity.dim}_confirm`,
                                                     { entity }));
    }
  }
}

module.exports = PromptDialog;
