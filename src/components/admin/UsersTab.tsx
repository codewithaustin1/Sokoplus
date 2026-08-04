import React, { memo } from "react";

interface UsersTabProps {
  AdminUsersTable: React.ComponentType<any>;
  usersList: any[];
  userSearchTerm: string;
  setUserSearchTerm: (val: string) => void;
  selectedUserUids: string[];
  setSelectedUserUids: (val: string[] | ((prev: string[]) => string[])) => void;
  handleBatchDeleteUsers: () => void;
  isBatchDeletingUsers: boolean;
  handleDownloadUsersCSV: () => void;
  isExportingUsers: boolean;
  deleteUserDoc: (uid: string) => void;
}

export const UsersTab: React.FC<UsersTabProps> = memo(({
  AdminUsersTable,
  usersList,
  userSearchTerm,
  setUserSearchTerm,
  selectedUserUids,
  setSelectedUserUids,
  handleBatchDeleteUsers,
  isBatchDeletingUsers,
  handleDownloadUsersCSV,
  isExportingUsers,
  deleteUserDoc,
}) => {
  return (
    <AdminUsersTable
      usersList={usersList}
      userSearchTerm={userSearchTerm}
      setUserSearchTerm={setUserSearchTerm}
      selectedUserUids={selectedUserUids}
      setSelectedUserUids={setSelectedUserUids}
      handleBatchDeleteUsers={handleBatchDeleteUsers}
      isBatchDeletingUsers={isBatchDeletingUsers}
      handleDownloadUsersCSV={handleDownloadUsersCSV}
      isExportingUsers={isExportingUsers}
      deleteUserDoc={deleteUserDoc}
    />
  );
});

export default UsersTab;
