interface DatabaseError {
  message?: string;
}

interface DatabaseResult {
  data: unknown;
  error: DatabaseError | null;
}

interface DeleteRequest extends PromiseLike<DatabaseResult> {
  eq: (column: string, value: string) => DeleteRequest;
}

export interface NotificationDeviceClient {
  rpc: (
    functionName: string,
    args: Record<string, string>,
  ) => PromiseLike<DatabaseResult>;
  from: (tableName: string) => {
    delete: () => DeleteRequest;
  };
}

export interface NotificationDeviceRegistrationInput {
  accountId: string;
  memberId: string;
  subscriptionId: string;
  platform: string;
}

export interface NotificationDeviceDeactivationInput {
  memberId?: string | null;
  subscriptionId: string;
}

export class NotificationDeviceOperationQueue {
  private readonly tails = new Map<string, Promise<void>>();

  run<T>(subscriptionId: string, operation: () => Promise<T>): Promise<T> {
    const normalizedId = subscriptionId.trim();
    const previous = this.tails.get(normalizedId) ?? Promise.resolve();
    const result = previous
      .catch(() => undefined)
      .then(operation);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );

    this.tails.set(normalizedId, tail);
    void tail.finally(() => {
      if (this.tails.get(normalizedId) === tail) {
        this.tails.delete(normalizedId);
      }
    });

    return result;
  }
}

const deviceOperationQueue = new NotificationDeviceOperationQueue();

function databaseError(
  operation: string,
  error: DatabaseError | null,
) {
  return new Error(
    `${operation}: ${error?.message ?? 'Unknown database error'}`,
  );
}

export async function registerCurrentNotificationDevice<Client extends object>(
  input: NotificationDeviceRegistrationInput,
  client: Client,
) {
  const databaseClient = client as unknown as NotificationDeviceClient;
  const subscriptionId = input.subscriptionId.trim();
  if (!subscriptionId) throw new Error('OneSignal subscription ID is required.');

  return deviceOperationQueue.run(subscriptionId, async () => {
    const accountResult = await databaseClient.rpc(
      'register_account_notification_device',
      {
        target_subscription_id: subscriptionId,
        target_platform: input.platform,
      },
    );
    if (accountResult.error) {
      throw databaseError(
        'Could not register this device for the account',
        accountResult.error,
      );
    }

    const accountDevice = accountResult.data as {
      account_id?: unknown;
      subscription_id?: unknown;
    } | null;
    if (
      accountDevice?.account_id !== input.accountId
      || accountDevice.subscription_id !== subscriptionId
    ) {
      throw new Error('The registered notification device did not match the active account.');
    }

    const legacyResult = await databaseClient.rpc(
      'claim_onesignal_subscription',
      {
        target_member_id: input.memberId,
        target_subscription_id: subscriptionId,
      },
    );
    if (legacyResult.error) {
      throw databaseError(
        'Could not update the compatible member notification record',
        legacyResult.error,
      );
    }

    return {
      accountId: input.accountId,
      memberId: input.memberId,
      subscriptionId,
    };
  });
}

export async function deactivateCurrentNotificationDevice<Client extends object>(
  input: NotificationDeviceDeactivationInput,
  client: Client,
) {
  const databaseClient = client as unknown as NotificationDeviceClient;
  const subscriptionId = input.subscriptionId.trim();
  if (!subscriptionId) return { errors: [] as string[] };

  return deviceOperationQueue.run(subscriptionId, async () => {
    const errors: string[] = [];
    const accountResult = await databaseClient.rpc(
      'deactivate_account_notification_device',
      { target_subscription_id: subscriptionId },
    );
    if (accountResult.error) {
      errors.push(
        databaseError(
          'Could not deactivate the account notification device',
          accountResult.error,
        ).message,
      );
    }

    if (input.memberId) {
      const legacyResult = await databaseClient
        .from('onesignal_subscriptions')
        .delete()
        .eq('member_id', input.memberId)
        .eq('subscription_id', subscriptionId);
      if (legacyResult.error) {
        errors.push(
          databaseError(
            'Could not remove the compatible member notification record',
            legacyResult.error,
          ).message,
        );
      }
    }

    return { errors };
  });
}
