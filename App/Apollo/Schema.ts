import { AsyncStorage } from "react-native";
import { Context } from "react-apollo";
import gql from "graphql-tag";
import { GraphQLResolveInfo } from "graphql";

import map from "lodash/map";
import AllExercises from "../Configuration/Exercises";
import {
  InMemoryCache,
  IntrospectionFragmentMatcher
} from "apollo-cache-inmemory";
import { withClientState } from "apollo-link-state";
import apolloCodegenData from "./schema.json";

import {
  Exercise,
  Query,
  Mutation,
  typeDefs,
  User,
  ExerciseConfiguration
} from "./Types";

const introspectionQueryResultData = {
  ...apolloCodegenData.data,
  __schema: {
    ...apolloCodegenData.data.__schema,
    types: apolloCodegenData.data.__schema.types.filter(
      (type: any) => type.possibleTypes !== null
    )
  }
};

const fragmentMatcher = new IntrospectionFragmentMatcher({
  introspectionQueryResultData
});

export const VERSION = "0.1";
export const cache = new InMemoryCache({ fragmentMatcher });

export type FirstArgument<T> = T extends (arg1: infer U, ...args: any[]) => any
  ? U
  : any;

type Remapped<T> = {
  [P in keyof T]: (
    parent: null | undefined,
    args: FirstArgument<T[P]>,
    ctx: Context & { cache: InMemoryCache },
    info?: GraphQLResolveInfo
  ) => any
};

type TResolvers = {
  Query: Remapped<Query>;
  Mutation: Remapped<Mutation>;
  User: Remapped<Partial<User>>;
};

export const resolvers: TResolvers = {
  Query: {
    user(obj, args, context, info) {
      const query = gql`
        query User {
          user {
            id
            configured
          }
        }
      `;

      const results: Query = cache.readQuery({
        query
      });

      if (results) {
        return results.user;
      }
    },

    exercises(obj, args, context, info) {
      console.log("1");
      const { cache, getCacheKey } = context;
      console.log("2");
      const query = gql`
        query AllExercises {
          exercises {
            id
            name
            shortName
            icon
            incrementFactor
            initialWeight
          }
        }
      `;
      console.log("3");

      const results: Query = cache.readQuery({
        query
      });
      console.log("4");

      console.log({ results });

      const { exercises } = results;

      console.log("5");
      if (exercises) {
        console.log("FOUND EXERCISES");
        console.log({ exercises });
        return exercises;
      }
    },

    async workout(obj, args, { cache, getCacheKey }) {
      const workouts = await AsyncStorage.getItem(`schedule`);

      if (workouts) {
        const { exercises } = JSON.parse(workouts);

        return (exercises || []).find(
          (exercise: Exercise) => exercise.id === args.id
        );
      }
      return null;
    }
  },

  User: {
    async upcomingWorkouts(obj, args, { cache, getCacheKey }) {
      const workouts = await AsyncStorage.getItem(`schedule`);

      if (workouts) {
        const { exercises } = JSON.parse(workouts);

        return (exercises || []).filter(
          (exercise: Exercise) => !exercise.completed
        );
      }
      return null;
    },

    async workouts(obj, args, { cache, getCacheKey }) {
      const workouts = await AsyncStorage.getItem(`schedule`);

      if (workouts) {
        const { exercises } = JSON.parse(workouts);

        return exercises || [];
      }
      return [];
    }
  },

  Mutation: {
    updateInitialWeight: async (_, variables, { cache, getCacheKey }) => {
      const id = getCacheKey({
        __typename: "Workout",
        id: variables.exerciseId
      });
      const fragment = gql`
        fragment completedWorkout on Workout {
          completed
        }
      `;
      const config =
        AllExercises[variables.exerciseId as keyof typeof AllExercises];
      const exercise = cache.readFragment({ fragment, id });
      const data = {
        ...(config || {}),
        ...exercise,
        initialWeight: variables.weight
      };
      cache.writeData({ id, data });

      return data;
    },

    completeWorkout: (_, variables, { cache, getCacheKey }) => {
      const id = getCacheKey({
        __typename: "Workout",
        id: variables.workoutId
      });
      const fragment = gql`
        fragment completedWorkout on Workout {
          completed
        }
      `;
      const exercise = cache.readFragment({ fragment, id });
      const data = { ...exercise, completed: new Date().getTime() };
      cache.writeData({ id, data });
      return data;
    },

    completeExercise: (_, variables, { cache, getCacheKey }) => {
      const id = getCacheKey({
        __typename: "Exercise",
        id: variables.exerciseId
      });
      const fragment = gql`
        fragment completeExercise on Exercise {
          completed
          amrap
        }
      `;

      const exercise = cache.readFragment({ fragment, id }) as Exercise;
      const data = { ...exercise, completed: new Date().getTime() };
      if (variables.amrap) {
        data.amrap = variables.amrap;
      }

      cache.writeData({ id, data });
      return data;
    },

    completeConfiguration: (_, variables, { cache, getCacheKey }) => {
      console.log("Completing config");
      const id = getCacheKey({
        __typename: "User",
        id: 1
      });
      const fragment = gql`
        fragment user on User {
          configured
        }
      `;

      const user = cache.readFragment({
        fragment,
        id
      }) as User;

      const data = {
        __typename: "CompleteConfigurationPayload",
        user: {
          __typename: "User",
          id: 1,
          schedule: null,
          ...user,
          configured: true
        }
      };

      console.log("Writing", data, id);

      cache.writeData({ id, data: data.user });
      return data;
    },

    toggleIncludeExercise: (_, variables, { cache, getCacheKey }) => {
      console.log("Looking for object with id", variables);
      const id = getCacheKey({
        __typename: "ExerciseConfiguration",
        id: variables.input.exerciseId
      });
      const fragment = gql`
        fragment completeExercise on ExerciseConfiguration {
          include
        }
      `;

      const exercise = cache.readFragment({
        fragment,
        id
      }) as ExerciseConfiguration;

      console.log({
        exercise,
        id: variables.input.exerciseId,
        AllExercises,
        existing: AllExercises[variables.input.exerciseId]
      });
      const data = {
        __typename: "IncludeExercisePayload",
        exercise: {
          __typename: "ExerciseConfiguration",
          id: variables.input.exerciseId,
          ...(AllExercises[variables.input.exerciseId] || {}),
          ...exercise,
          include: exercise.include === "EXCLUDED" ? "INCLUDED" : "EXCLUDED"
        }
      };

      console.log({ data });

      cache.writeData({ id, data: data.exercise });
      return data;
    }
  }
};

export const defaults = {
  exercises: map(AllExercises, (exercise, key) => ({
    id: key,
    initialWeight: null,
    __typename: "ExerciseConfiguration",
    ...exercise
  })),
  user: {
    __typename: "User",
    id: 1,
    configured: false,
    schedule: null
  },

  networkStatus: {
    __typename: "NetworkStatus",
    isConnected: true
  }
};

export const link = withClientState({ cache, resolvers, typeDefs, defaults });
